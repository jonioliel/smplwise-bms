| Scene | Rung | AO off ms (GTAO 6 / full blend) | AO on ms (GTAO 4 / 0.6 blend) | Cost | Calls off / on | Volume | Bytes | First bake | GTAO with AO |
|---|---|---|---|---|---|---|---|---|---|
| house | realistic | 57.83 | 58.17 | 0.34 | 288 / 288 | 61x14x55 | 93940 | worker 2028 ms bake, 5568 ms total | {"samples":4,"blend":0.33} |
| house | lite | 34.21 | 33.18 | -1.03 | 160 / 160 | 61x14x55 | 93940 | worker 2028 ms bake, 5568 ms total | null |
| dense | realistic | 61.55 | 63.5 | 1.95 | 208 / 208 | 96x15x69 | 198720 | worker 2755 ms bake, 2994 ms total | {"samples":4,"blend":0.33} |
| dense | lite | 32.99 | 33.67 | 0.68 | 98 / 98 | 96x15x69 | 198720 | worker 2755 ms bake, 2994 ms total | null |
