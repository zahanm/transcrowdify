
from __future__ import print_function

import sys
import os
import json
from subprocess import call
from glob import glob

import Image

from pyPdf import PdfFileWriter, PdfFileReader

'''
Module to split pdf file into segments
dependencies: django and journal_app models
'''

DOG_INPUT_FNAME = 'split.json'
SEGMENTS_PER_PAGE = 6

def split_pages(pdf_fieldfile):
  out_fnames = []
  with open(pdf_fieldfile.path, 'rb') as inp_file:
    inp = PdfFileReader(inp_file)
    for page in xrange(inp.getNumPages()):
      out = PdfFileWriter()
      out.addPage(inp.getPage(page))
      out_file = NamedTemporaryFile(suffix='.pdf', delete=False)
      out.write(out_file)
      out_file.close()
      out_fnames.append(out_file.name)
  return out_fnames

def convert_pages(pdf_fnames):
  for page, pdf_fname in enumerate(pdf_fnames):
    png_file = NamedTemporaryFile(suffix='.png', delete=False)
    png_file.close()
    args = ['convert', pdf_fname, '-quality', '4', png_file.name]
    retcode = call(args)
    if retcode != 0:
      raise RuntimeError('Error while converting pdf to png')
    yield png_file.name

def divide_page(page_num, png_fname):
  page = Image.open(png_fname)
  page_width, page_height = page.size
  segment_height = page_height / SEGMENTS_PER_PAGE
  left, upper, right, lower = 0, 0, page_width, segment_height
  for segment_num in xrange(SEGMENTS_PER_PAGE):
    segment_fname = 'data/segment_{0}_{1}.png'.format(page_num, segment_num)
    segment = page.copy()
    segment = segment.crop((left, upper, right, lower))
    segment.save(segment_fname)
    yield segment_fname
    upper += segment_height
    lower += segment_height
  page.close()

def split_pdf(pdf_fieldfile):
  output = []
  pdf_fnames = split_pages(pdf_fieldfile)
  for page, png_fname in enumerate(convert_pages(pdf_fnames)):
    for segment_fname in divide_page(page, png_fname):
      output.append({ 'location': segment_fname, 'page': page })
  with open(DOG_INPUT_FNAME, 'w') as dog_input:
    json.dump(output, dog_input)
  return json.dumps(output)

def cleanup_last_run():
  file_globs = ['data/*.png', 'tmp/*.pdf', 'tmp/*.png', 'tmp/*.tex',
    'tmp/*.aux', 'tmp/*.log', 'output/*.pdf']
  map(lambda fg: os.remove(glob(fg)), file_globs)

if __name__ == '__main__':
  # change this to use djange.FileField
  if(len(sys.argv) == 2):
    cleanup_last_run()
    print(split_pdf(sys.argv[1]))
  else:
    print('usage: python', __file__, '<input_pdf>')
