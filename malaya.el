;;; emacs mode for charjes (javascript+CHR)

(require 'js)

(define-derived-mode malaya-mode js-mode
  "malaya-mode"
  "malaya mode is a major mode for editing malaya files"
  (font-lock-add-keywords nil '(("\\_<\\(store\\|query\\|where\\|rule\\|invariant\\|fail\\)\\_>" . 'font-lock-keyword-face))) )

(provide 'malaya-mode)
