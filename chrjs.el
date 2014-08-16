;;; emacs mode for charjes (javascript+CHR)

(require 'js)

(define-derived-mode chrjs-mode js-mode "CHRjs"
    "chrjs mode is a major mode for editing chrjs files"
  
    ;; you again used quote when you had '((mydsl-hilite))
    ;; I just updated the variable to have the proper nesting (as noted above)
    ;; and use the value directly here
    ;(setq font-lock-defaults mydsl-font-lock-defaults)
  
    )
  
(provide 'chrjs-mode)
