#! py_packages/bin/python

import Image, ImageDraw

from split import optimal_dividers

def draw_lines(im):
  optimal = optimal_dividers(im)
  width, height = im.size
  target = im.copy()
  draw = ImageDraw.Draw(target)
  for h in optimal:
    draw.line((0, h, width, h), fill='red')
  target.save('./tmp/lined.png')

FNAME = './tmp/aaa.jpg'

if __name__ == '__main__':
  im = Image.open(FNAME)
  draw_lines(im)
