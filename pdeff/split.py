
from __future__ import print_function

import sys
import os
import os.path as path
import json
import itertools
from subprocess import call
from glob import glob
from tempfile import NamedTemporaryFile

import Image

from pyPdf import PdfFileWriter, PdfFileReader

from utils import topk_pos

'''
Module to split pdf file into segments
dependencies: imagemagick, pyPdf, Python Image Lib

expect input on stdin:
journal pdf file name
'''

#### Pages

def split_pages(pdf_fname):
  out_fnames = []
  with open(pdf_fname, 'rb') as inp_file:
    inp = PdfFileReader(inp_file)
    for page in xrange(inp.getNumPages()):
      out = PdfFileWriter()
      out.addPage(inp.getPage(page))
      out_file = NamedTemporaryFile(suffix='.pdf', dir=path.abspath('./tmp/'), delete=False)
      out.write(out_file)
      out_file.close()
      out_fnames.append(out_file.name)
  return out_fnames

def convert_pages(page_fnames):
  for page, page_fname in enumerate(page_fnames):
    png_file = NamedTemporaryFile(suffix='.png', dir=path.abspath('./tmp/'), delete=False)
    png_file.close()
    args = ['convert', page_fname, '-quality', '5', png_file.name]
    retcode = call(args)
    if retcode != 0:
      raise RuntimeError('Error while converting pdf to png')
    yield png_file.name

#### Sections in a page

# Two approaches
# - Automagically:
#   Find an acceptable noise level for blank sections of page.
#   Identify bands of blank section.
#   Choose blank sections that get divisions close to desired number per page
#   Pick a line each that is close to middle of chosen section
#   Divide on those lines
# - Using human input:
#   Perhaps identify dividing lines in automagic first pass
#   Create task for human that presents page with set number of dividers
#   Human drags divders to desired locations
#   Optionally human also designates sections as math or text

SEGMENTS_PER_PAGE = 6
DIVIDER_CANDIDATES = 150

def line_histogram(im):
  pixdata = im.load()
  width, height = im.size
  def liner(h):
    intensity = 0
    for w in xrange(width):
      intensity += sum(pixdata[w,h][:3])
    return intensity
  line_hist = map(liner, xrange(height))
  return line_hist

def optimal_dividers(im):
  hist = line_histogram(im)
  candidates = topk_pos(hist, DIVIDER_CANDIDATES)
  width, height = im.size
  optimal = map(lambda i: (i+1) * (height / SEGMENTS_PER_PAGE), range(SEGMENTS_PER_PAGE)[:-1])
  def closest_pos(l, item):
    close = 0
    dist = abs(l[close] - item)
    for pos, v in enumerate(l):
      diff = abs(v - item)
      if diff < dist:
        dist = diff
        close = pos
    return close
  for pos, d in enumerate(optimal):
    p = closest_pos(candidates, d)
    optimal[pos] = candidates[p]
    del candidates[p]
  return optimal

def divide_page(page_num, page_fname):
  page = Image.open(page_fname)
  width, height = page.size
  base_name = path.splitext(path.basename(page_fname))[0] + '_{0}.png'
  segment_fname_template = path.join(path.abspath('./static/images/'), base_name)
  left, right = 0, width
  optimal = optimal_dividers(page)
  optimal = [0] + optimal + [height]
  for i, (top, bottom) in enumerate(itertools.izip(optimal[:-1], optimal[1:])):
    segment_fname = segment_fname_template.format(i)
    segment = page.copy()
    segment = segment.crop((left, top, right, bottom))
    segment.save(segment_fname)
    yield segment_fname

#### The entire pdf, util

def split_pdf(pdf_fname):
  output = []
  page_fnames = split_pages(pdf_fname)
  for page, png_fname in enumerate(convert_pages(page_fnames)):
    for segment_fname in divide_page(page, png_fname):
      output.append({ 'location': segment_fname, 'page': page+1 })
  json.dump(output, sys.stdout)

def split_image(image_fname):
  # check if it is in portrait orientation
  im = Image.open(image_fname)
  width, height = im.size
  if width > height:
    out = im.transpose(Image.ROTATE_270)
    out.save(image_fname)
  # split it up
  output = []
  for segment_fname in divide_page(0, image_fname):
    output.append({ 'location': segment_fname, 'page': 1 })
  json.dump(output, sys.stdout)

def cleanup_last_run():
  file_globs = ['tmp/*.pdf', 'tmp/*.png', 'tmp/*.tex', 'tmp/*.aux', 'tmp/*.log']
  for fg in file_globs:
    map(lambda f: os.unlink(f), glob(fg))

def usage():
  print('usage: python', __file__, '<pdf|jpg|png> and [input_pdf on stdio]')

#### Initialize

if __name__ == '__main__':
  if len(sys.argv) == 2:
    cleanup_last_run()
    ftype = sys.argv[1]
    fname = sys.stdin.read().strip()
    if ftype == 'pdf':
      split_pdf(fname)
    elif ftype in set(['jpg', 'png']):
      split_image(fname)
    else:
      usage()
  else:
    usage()
