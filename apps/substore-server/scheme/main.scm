(import
  (scheme base)
  (scheme write)
  (srfi 257))

(define x
  (match (list 1 2 3)
    ((~list a b c) b)))

(display x)

