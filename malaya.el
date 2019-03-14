;;; emacs mode for malaya source files (javascript+CHR)

(require 'js)

(define-derived-mode malaya-mode js-mode
  "malaya-mode"
  "malaya mode is a major mode for editing chrjs files"
  (font-lock-add-keywords nil '(("\\_<\\(store\\|query\\|where\\|rule\\|fail\\|plugin\\)\\_>" . 'font-lock-keyword-face))) )

(provide 'malaya-mode)
