with import <nixpkgs> {};
stdenv.mkDerivation {
  name = "malaya-build-env";
  buildInputs = [ systemd nodejs ];
  shellHook = ''export PATH=./node_modules/.bin:$PATH'';
}
