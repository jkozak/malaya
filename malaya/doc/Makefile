all:	ops.html

first_diag.png:	first_diag.shk images/*
	shake -exec first_diag.shk -node first_diag

first_diag-small.png: first_diag.png
	convert first_diag.png -resize 900 first_diag-small.png # +++ do this in shake!

ops.html:	first_diag-small.png ops.txt doc.css
	pandoc -c doc.css -o ops.html ops.txt

clean:
	rm -f *.html *.png
