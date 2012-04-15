
from __future__ import print_function

import sys
import json
import itertools
import os
import os.path as path
from tempfile import NamedTemporaryFile
from subprocess import Popen, PIPE

import Image

from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch

from pyPdf import PdfFileReader, PdfFileWriter

from utils import strip_extra_whitespace

try:
  from cStringIO import StringIO
except ImportError:
  from StringIO import StringIO

'''
Joins png's together to make one multi-page pdf
dependencies: pyPdf, reportlab, Python Image Lib

expects input on stdin:
[
  {
    page: 0,
    location: 'adsf/sda.png',
    transcription: 'Writing in now',
    type: 'text'
  },
  ...
]
'''

PARA_PADDING = 25

def paint_original_segments(fnames, transcriptions, page):
  page_file = NamedTemporaryFile(suffix='.pdf', dir=path.abspath('./tmp/'), delete=False)
  pdf = Canvas(page_file.name, pagesize=A4)
  page_width, top = A4
  for fname, transcription in itertools.izip(fnames, transcriptions):
    segment = Image.open(fname)
    width, height = segment.size
    p = Paragraph(transcription, ParagraphStyle('Normal', alignment=TA_CENTER))
    p.wrapOn(pdf, page_width - PARA_PADDING * 2, height)
    p.drawOn(pdf, PARA_PADDING, top - height / 2)
    pdf.drawImage(fname, 0, top - height)
    top -= height
  pdf.save()
  page_file.close()
  return page_file.name

LATEX_WRAP = """
\\documentclass{{article}}
\\usepackage{{amsmath}}
\\usepackage{{parskip}}
\\begin{{document}}
\\begin{{{font_size}}}
{raw_latex}
\\end{{{font_size}}}
\\end{{document}}
"""

LATEX_EQN_SNIPPET = """
\\begin{{eqnarray*}}
{0}
\\end{{eqnarray*}}
"""

LATEX_NEWPAGE_SNIPPET = """
\\newpage
"""

LATEX_FONT_SIZE = 'large'

LATEX_BUILD_FNAME = 'builder.{format}'

def latex_to_pdf(raw_latex):
  with open(path.join('tmp', LATEX_BUILD_FNAME.format(format='tex')), 'w') as latex_file:
    latex_file.write(raw_latex)
  pdfcreator = ['pdflatex', '-interaction', 'nonstopmode', '-output-directory', 'tmp', LATEX_BUILD_FNAME.format(format='tex')]
  child = Popen(pdfcreator, stdout=PIPE)
  retcode = child.wait()
  if retcode != 0:
    stdoutdata, stderrdata = child.communicate()
    sys.stderr.write(raw_latex + '\n')
    sys.stderr.write(stdoutdata + '\n')
    raise RuntimeError('Error while creating math image with pdflatex')
    return LATEX_BUILD_FNAME.format(format='tex')
  latex_pdf = NamedTemporaryFile(prefix='transcribed_', suffix='.pdf', dir=path.abspath('./static/images/'), delete=False)
  with open(path.join('tmp', LATEX_BUILD_FNAME.format(format='pdf')), 'rb') as pdf_contents:
    latex_pdf.write(pdf_contents.read())
  latex_pdf.close()
  os.unlink(path.join('tmp', LATEX_BUILD_FNAME.format(format='pdf')))
  return latex_pdf.name

def assemble_latex(fnames, transcriptions, types):
  buf = StringIO()
  for transcription, t_type in itertools.izip(transcriptions, types):
    stripped = strip_extra_whitespace(transcription)
    if t_type == 'math':
      buf.write(LATEX_EQN_SNIPPET.format(stripped))
    else:
      # t_type= 'text'
      buf.write(stripped.replace('_', '\_').replace('^', '\^'))
    buf.write('\\newline\n')
  return buf.getvalue()

def join_pages(composites):
  # latex_buf = StringIO()
  page_fnames = []
  for page_num, collection in enumerate(collect_pages(composites)):
    fnames, transcriptions, types = [], [], []
    for r in collection:
      fnames.append(r['location'])
      transcriptions.append(r['transcription'])
      types.append(r['type'])
    page_fnames.append(paint_original_segments(fnames, transcriptions, page_num))
  #   latex_buf.write(assemble_latex(fnames, transcriptions, types))
  #   latex_buf.write(LATEX_NEWPAGE_SNIPPET)
  # raw_latex = LATEX_WRAP.format(raw_latex=latex_buf.getvalue(), font_size=LATEX_FONT_SIZE)
  # # transcribed pdf
  # latex_pdf_fname = latex_to_pdf(raw_latex)
  # ---
  # searchable pdf
  pdf_writer = PdfFileWriter()
  pdf_pages = []
  for page_fname in page_fnames:
    pdf_pages.append(open(page_fname, 'rb'))
    pdf_reader = PdfFileReader(pdf_pages[-1])
    pdf_writer.addPage(pdf_reader.getPage(0))
  searchable_pdf = NamedTemporaryFile(prefix='searchable_', suffix='.pdf', dir=path.abspath('./static/images/'), delete=False)
  pdf_writer.write(searchable_pdf)
  searchable_pdf.close()
  map(lambda f: f.close(), pdf_pages)
  json.dump({
    # 'transcribed': latex_pdf_fname,
    'searchable': searchable_pdf.name
  }, sys.stdout)

def collect_pages(composites):
  # first sort by page number
  composites.sort(key=lambda composite: composite['page'])
  for page, collection in itertools.groupby(composites, key=lambda composite: composite['page']):
    yield collection

def json_decode(json_output):
  output = None
  try:
    output = json.loads(json_output)
  except TypeError:
    pass
  if not output:
    return []
  return output

if __name__ == '__main__':
  if len(sys.argv) == 1:
    composites = json_decode(sys.stdin.read())
    if composites:
      join_pages(composites)
  else:
    print('usage: python', __file__, '<output_from_dog>')
