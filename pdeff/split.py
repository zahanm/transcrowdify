
from __future__ import print_function

import sys
import os
import os.path as path
import json
from subprocess import call
from glob import glob
from tempfile import NamedTemporaryFile

import Image

from pyPdf import PdfFileWriter, PdfFileReader

'''
Module to split pdf file into segments
dependencies: imagemagick, pyPdf, Python Image Lib

expect input on stdin:
journal pdf file name
'''

SEGMENTS_PER_PAGE = 6

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

def divide_page(page_num, page_fname):
  page = Image.open(page_fname)
  page_width, page_height = page.size
  segment_height = page_height / SEGMENTS_PER_PAGE
  base_name = path.splitext(path.basename(page_fname))[0] + '_{0}.png'
  segment_fname_template = path.join(path.abspath('./static/images/'), base_name)
  left, upper, right, lower = 0, 0, page_width, segment_height
  for segment_num in xrange(SEGMENTS_PER_PAGE):
    segment_fname = segment_fname_template.format(segment_num)
    segment = page.copy()
    segment = segment.crop((left, upper, right, lower))
    segment.save(segment_fname)
    yield segment_fname
    upper += segment_height
    lower += segment_height

def split_pdf(pdf_fname):
  output = []
  page_fnames = split_pages(pdf_fname)
  for page, png_fname in enumerate(convert_pages(page_fnames)):
    for segment_fname in divide_page(page, png_fname):
      output.append({ 'location': segment_fname, 'page': page })
  json.dump(output, sys.stdout)

def cleanup_last_run():
  file_globs = ['tmp/*.pdf', 'tmp/*.png', 'tmp/*.tex', 'tmp/*.aux', 'tmp/*.log']
  for fg in file_globs:
    map(lambda f: os.unlink(f), glob(fg))

if __name__ == '__main__':
  if len(sys.argv) == 1:
    cleanup_last_run()
    split_pdf(sys.stdin.read())
  else:
    print('usage: python', __file__, '<input_pdf>')
