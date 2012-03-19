
from heapq import nlargest

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
def topk_pos(l, k):
  pos_val = nlargest(k, enumerate(l), lambda i: i[1])
  vals = map(lambda i: i[0], pos_val)
  return sorted(vals)
