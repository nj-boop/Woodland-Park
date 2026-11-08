#!/usr/bin/env bash
# Rebuild every animal model from the Blender scripts, then convert them for the web.
# Needs: pip install bpy==5.2.3 scikit-image numpy
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p build/glb
python3 assets/blender/build_zebra.py build/glb
for sp in giraffe lion tiger elephant polar camel fox bison monkey gorilla penguin kangaroo dolphin orca shark sealion turtle beluga manatee mammoth sabre; do
  python3 assets/blender/build_animals.py "$sp" build/glb
done
python3 tools/glb-to-json.py build/glb assets/models
