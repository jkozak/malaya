with import <nixpkgs> {};
stdenv.mkDerivation {
  name = "malaya-build-env";
  buildInputs = [ systemd nodejs-18_x jq ];
  shellHook = ''
export PATH=${builtins.getEnv "PWD"}/node_modules/.bin:$PATH
#export HISTFILE=${builtins.getEnv "PWD"}/.bash_history
#history -c
#history -r $HISTFILE
'';
}
