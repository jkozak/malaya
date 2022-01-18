with import <nixpkgs> {};
stdenv.mkDerivation {
  name = "malaya-build-env";
  buildInputs = [ systemd nodejs-16_x jq ];
  shellHook = ''export PATH=./node_modules/.bin:$PATH'';
}
