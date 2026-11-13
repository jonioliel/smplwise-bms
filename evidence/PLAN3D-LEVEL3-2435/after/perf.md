renderer: {"vendor":"Google Inc. (Intel)","renderer":"ANGLE (Intel, Intel(R) UHD Graphics (0x00009B41) Direct3D11 vs_5_0 ps_5_0, D3D11)"}

| run | shot | rung | ms (median of 5 x 30) | calls | triangles | real graph meshes | realStats |
|---|---|---|---|---|---|---|---|
| after | dense-L0-iso-3 | realistic | 59.35 | 170 | 40833 | ao-blobs 1, ao-strips 1, caps 1, door 34, merged 8, model-merged 6, obj 24 | {"meshes":82,"instanced":0,"merged":8,"models":6,"furnitureMerged":84} |
| after | dense-both-iso-3 | realistic | 61.29 | 314 | 81345 | ao-blobs 1, ao-strips 1, caps 2, door 68, merged 16, model-merged 12, obj 48 | {"meshes":161,"instanced":0,"merged":16,"models":12,"furnitureMerged":168} |
| after | house-L0-iso-3 | realistic | 63.77 | 182 | 36293 | ao-blobs 1, ao-strips 1, caps 1, door 19, glow 12, merged 21, model-merged 12, obj 11, shutter 2 | {"meshes":71,"instanced":0,"merged":21,"models":12,"furnitureMerged":81} |
| after | house-both-iso-3 | realistic | 60.85 | 298 | 66089 | ao-blobs 1, ao-strips 1, caps 2, door 29, glow 22, merged 40, model-merged 21, obj 20, shutter 3 | {"meshes":123,"instanced":0,"merged":40,"models":21,"furnitureMerged":144} |
| after | house-both-persp-3 | realistic | 63.19 | 298 | 66089 | ao-blobs 1, ao-strips 1, caps 2, door 29, glow 22, merged 40, model-merged 21, obj 20, shutter 3 | {"meshes":123,"instanced":0,"merged":40,"models":21,"furnitureMerged":144} |
| after | dense-L0-iso-3-lite | lite | 31.18 | 92 | 20712 | ao-blobs 1, ao-strips 1, caps 1, door 34, merged 8, model-merged 6, obj 24 | {"meshes":82,"instanced":0,"merged":8,"models":6,"furnitureMerged":84} |
| after | dense-both-iso-3-lite | lite | 33.64 | 164 | 41188 | ao-blobs 1, ao-strips 1, caps 2, door 68, merged 16, model-merged 12, obj 48 | {"meshes":161,"instanced":0,"merged":16,"models":12,"furnitureMerged":168} |
| after | house-L0-iso-3-lite | lite | 32.45 | 109 | 18892 | ao-blobs 1, ao-strips 1, caps 1, door 19, glow 12, merged 21, model-merged 12, obj 11, shutter 2 | {"meshes":71,"instanced":0,"merged":21,"models":12,"furnitureMerged":81} |
| after | house-both-iso-3-lite | lite | 33.02 | 176 | 34324 | ao-blobs 1, ao-strips 1, caps 2, door 29, glow 22, merged 40, model-merged 21, obj 20, shutter 3 | {"meshes":123,"instanced":0,"merged":40,"models":21,"furnitureMerged":144} |
| after | house-both-persp-3-lite | lite | 32.7 | 176 | 34324 | ao-blobs 1, ao-strips 1, caps 2, door 29, glow 22, merged 40, model-merged 21, obj 20, shutter 3 | {"meshes":123,"instanced":0,"merged":40,"models":21,"furnitureMerged":144} |
