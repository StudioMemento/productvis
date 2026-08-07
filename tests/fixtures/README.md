# Smoke-test fixtures

`foundation-cube.glb` is a tiny, self-contained glTF 2.0 binary generated for PRODUCT VIS V1.1 browser smoke tests.

It contains one indexed cube mesh, hard-edge normals and one opaque PBR material. It has no external resources, compression or animation, so it isolates the core import → normalize → ground → frame pipeline from decoder-specific failures.
