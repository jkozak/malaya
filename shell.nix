with import <nixpkgs> {};
stdenv.mkDerivation {
  name = "malaya-build-env";
  buildInputs = [ systemd nodejs ];
}
