renderer: {"vendor":"Google Inc. (Intel)","renderer":"ANGLE (Intel, Intel(R) UHD Graphics (0x00009B41) Direct3D11 vs_5_0 ps_5_0, D3D11)"}

realistic rung, 1280 x 800, 9 interleaved pairs of benchFrames(15), median ms

| scene | reflections off | on | cost | calls | triangles | passes |
|---|---|---|---|---|---|---|
| house L0 iso (marble) | 59.54 | 65.84 | 6.3 | 182 | 36293 | render-msaa2 > gtao > ssr > bloom > output |
| house dining close-up (marble) | 81.79 | 100.17 | 18.38 | 94 | 23205 | render-msaa2 > gtao > ssr > bloom > output |
| dense floor iso | 60.93 | 65.69 | 4.76 | 170 | 40833 | render-msaa2 > gtao > ssr > bloom > output |
