;;; emacs mode for charjes (javascript+CHR)

(require 'js)

(define-derived-mode chrjs-mode js-mode
  "chrjs-mode"
  "chrjs mode is a major mode for editing chrjs files"
  (font-lock-add-keywords nil '(("\\_<\\(store\\|query\\|rule\\)\\_>" . 'font-lock-keyword-face))) )

(provide 'chrjs-mode)
