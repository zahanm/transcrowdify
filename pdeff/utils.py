
from heapq import nsmallest

def strip_extra_whitespace(s):
  o = []
  for line in s.split('\n'):
    if line.strip():
      o.append(line.strip())
  return '\n'.join(o)

# Bottom K items in a list
# Uses a min-heap
# returns list of tuples `[ ... (pos, val) ... ]`
# returns positions of bottomk
def bottomk_pos(l, k):
  pos_val = nsmallest(k, enumerate(l), lambda i: i[1])
  return map(lambda i: i[0], pos_val)
