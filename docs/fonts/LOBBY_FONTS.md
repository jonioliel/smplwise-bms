# Lobby notice-board fonts (LOBBY-STYLES-2300)

Owner approval 2026-10-30: download IBM Plex Sans Hebrew, IBM Plex Mono, Frank Ruhl Libre, David Libre and Bodoni Moda (all SIL Open Font License 1.1) from Google Fonts and bundle them with their licence files. Nothing else was downloaded.

Method: the Google Fonts CSS API (`fonts.googleapis.com/css2`, Chrome user agent) names the woff2 files on `fonts.gstatic.com`; only the `hebrew` and `latin` subsets of the needed weights were fetched, each into a new empty folder (checked: every file starts with the `wOF2` signature). The licence texts come from the `google/fonts` GitHub repository (`ofl/<family>/OFL.txt`).

Files live in `frontend/public/fonts/lobby/` (with the OFL texts). `scripts/notice_tv_fonts.py` inlines the used ones into `frontend/src/notice-tv/tv-fonts.css` (the TV page reaches no other file). The two Plex Sans Hebrew weight-700 files were downloaded, then not used (the urgent title uses 600) and removed from the repository.

| File | Source URL | Bytes | sha256 |
| --- | --- | ---: | --- |
| plex-sans-hebrew-hebrew-200.woff2 | https://fonts.gstatic.com/s/ibmplexsanshebrew/v12/BCa5qYENg9Kw1mpLpO0bGM5lfHAAZHhDXEVt2006jDu19Q.woff2 | 5732 | 63a5da3bf1743fd61cde771cf79c340338c45765cfbf8196e6e2a56052350eba |
| plex-sans-hebrew-latin-200.woff2 | https://fonts.gstatic.com/s/ibmplexsanshebrew/v12/BCa5qYENg9Kw1mpLpO0bGM5lfHAAZHhDXEVt2004jDs.woff2 | 20896 | eab52ab1759accc1ee484592bddf5ab4c13060d1bc05dcffdb2ba05602ac41c6 |
| plex-sans-hebrew-hebrew-300.woff2 | https://fonts.gstatic.com/s/ibmplexsanshebrew/v12/BCa5qYENg9Kw1mpLpO0bGM5lfHAAZHhDXEUJ2E06jDu19Q.woff2 | 5716 | bc59ed98b8c05563f35ff4b68f88a725990d77c65e92736fa47cd6eef07cf762 |
| plex-sans-hebrew-latin-300.woff2 | https://fonts.gstatic.com/s/ibmplexsanshebrew/v12/BCa5qYENg9Kw1mpLpO0bGM5lfHAAZHhDXEUJ2E04jDs.woff2 | 20704 | c50b8beeda1563663455fa5af2c782e21445bbdaf37b77032fbac6065b3f30ce |
| plex-sans-hebrew-hebrew-400.woff2 | https://fonts.gstatic.com/s/ibmplexsanshebrew/v12/BCa2qYENg9Kw1mpLpO0bGM5lfHAAZHhDXE2g-lgHrQ.woff2 | 5476 | 087793392c1abaa1ad918f3e2ca7e991cbf2cb6d4a991944fa8b9e336c12aab1 |
| plex-sans-hebrew-latin-400.woff2 | https://fonts.gstatic.com/s/ibmplexsanshebrew/v12/BCa2qYENg9Kw1mpLpO0bGM5lfHAAZHhDXE2i-lg.woff2 | 19452 | f3f80a783f878dc6f0f637e6e541234434b9b6839dcd9f3da3552703e4d76b2a |
| plex-sans-hebrew-hebrew-500.woff2 | https://fonts.gstatic.com/s/ibmplexsanshebrew/v12/BCa5qYENg9Kw1mpLpO0bGM5lfHAAZHhDXEVR2U06jDu19Q.woff2 | 5668 | 3f85b2d84d91b35cdd7abb4b7b100bd218a5e5de83fc19b2d7e0d2f174a10e18 |
| plex-sans-hebrew-latin-500.woff2 | https://fonts.gstatic.com/s/ibmplexsanshebrew/v12/BCa5qYENg9Kw1mpLpO0bGM5lfHAAZHhDXEVR2U04jDs.woff2 | 20328 | f21bfcb2593478480d9e85761fa209500d041088a0c1630af5daaa3bb1113486 |
| plex-sans-hebrew-hebrew-600.woff2 | https://fonts.gstatic.com/s/ibmplexsanshebrew/v12/BCa5qYENg9Kw1mpLpO0bGM5lfHAAZHhDXEV93k06jDu19Q.woff2 | 5652 | 2a0832e31ca7571d89f13a385d1b45f431415160b631eff71636c2a9483b87dc |
| plex-sans-hebrew-latin-600.woff2 | https://fonts.gstatic.com/s/ibmplexsanshebrew/v12/BCa5qYENg9Kw1mpLpO0bGM5lfHAAZHhDXEV93k04jDs.woff2 | 20692 | 8216c868e967c513a82b220e25b01ea6f11f26d85dc5a55b549fdd78a1d86157 |
| plex-sans-hebrew-hebrew-700.woff2 | https://fonts.gstatic.com/s/ibmplexsanshebrew/v12/BCa5qYENg9Kw1mpLpO0bGM5lfHAAZHhDXEUZ3006jDu19Q.woff2 | 5644 | 7127a3cf5a6f98b5db2a89ca2802765fd9e2d34336dde46423fa421214796e03 |
| plex-sans-hebrew-latin-700.woff2 | https://fonts.gstatic.com/s/ibmplexsanshebrew/v12/BCa5qYENg9Kw1mpLpO0bGM5lfHAAZHhDXEUZ3004jDs.woff2 | 19708 | a07b17697aad7bccad286a14a98555166de7efa390abeabc55da722bf8592d64 |
| plex-mono-latin-400.woff2 | https://fonts.gstatic.com/s/ibmplexmono/v20/-F63fjptAgt5VM-kVkqdyU8n1i8q1w.woff2 | 14708 | 08949f728dc52d528e69b1667d15c89a5686a4ee9a296ff90983985f99c380f7 |
| plex-mono-latin-500.woff2 | https://fonts.gstatic.com/s/ibmplexmono/v20/-F6qfjptAgt5VM-kVkqdyU8n3twJwlBFgg.woff2 | 14888 | 01d285447409c8a588692162439a038b8cbd7871309ee20267b0d2d91c6e8e22 |
| OFL-IBMPlexSansHebrew.txt | https://raw.githubusercontent.com/google/fonts/main/ofl/ibmplexsanshebrew/OFL.txt | 4456 | 7e6b2818edbd8f6a01ae80641cc8f16a51080d08fb4e532be3a0b6f74adb07da |
| OFL-IBMPlexMono.txt | https://raw.githubusercontent.com/google/fonts/main/ofl/ibmplexmono/OFL.txt | 4456 | 7e6b2818edbd8f6a01ae80641cc8f16a51080d08fb4e532be3a0b6f74adb07da |
| frank-ruhl-libre-hebrew-300-700.woff2 | https://fonts.gstatic.com/s/frankruhllibre/v23/j8_w6_fAw7jrcalD7oKYNX0QfAnPW7Ll4ajn.woff2 | 18748 | acdf9ed0a3fc287df8401d796892c1f72118f291e510e38328396f48e200b08c |
| frank-ruhl-libre-latin-300-700.woff2 | https://fonts.gstatic.com/s/frankruhllibre/v23/j8_w6_fAw7jrcalD7oKYNX0QfAnPW7Dl4Q.woff2 | 44332 | b8081e5e9acd530df59ef062f9274e201569b94c9bfa6881950f3eb259d7b375 |
| david-libre-hebrew-400.woff2 | https://fonts.gstatic.com/s/davidlibre/v17/snfus0W_99N64iuYSvp4W8l54J-jYQ.woff2 | 12156 | 9dedc029ea208eec5cc04c6a289dd1ca30bc4adf78a4dc9c146ccbae87512b2e |
| david-libre-latin-400.woff2 | https://fonts.gstatic.com/s/davidlibre/v17/snfus0W_99N64iuYSvp4W8l74J8.woff2 | 24988 | fd102665a417494831fda4d0abb4a3c40df9ea0f16747d721766931d3e8e510c |
| david-libre-hebrew-500.woff2 | https://fonts.gstatic.com/s/davidlibre/v17/snfzs0W_99N64iuYSvp4W8GIw4qeQDKhSg.woff2 | 12192 | 08f5b82d26b140c763a2b466f20817a3bd0c7842815df49eb8503ab2211b9e7c |
| david-libre-latin-500.woff2 | https://fonts.gstatic.com/s/davidlibre/v17/snfzs0W_99N64iuYSvp4W8GIw4qcQDI.woff2 | 25568 | ccd127367d7e85fc7cb3d500b0d7858ad3e15e14734002c49b7194870b8d110c |
| david-libre-hebrew-700.woff2 | https://fonts.gstatic.com/s/davidlibre/v17/snfzs0W_99N64iuYSvp4W8HAxYqeQDKhSg.woff2 | 12852 | 1b4fc136888d6c5ee65740aade6660f68bbc75c65bac663938c9ec50f07fe5af |
| david-libre-latin-700.woff2 | https://fonts.gstatic.com/s/davidlibre/v17/snfzs0W_99N64iuYSvp4W8HAxYqcQDI.woff2 | 26296 | c36ca4cfb80e2504582acdafad26bf842034b166cc9dcf5c6f77755b1816ea92 |
| bodoni-moda-latin-400-700.woff2 | https://fonts.gstatic.com/s/bodonimoda/v28/aFTH7PxzY382XsXX63LUYL6GYFcan6NJrKp-VPj1KOxQ.woff2 | 25884 | 192ae876c21d9258d096a526dad5bddf37f0daa69cfe943cae5f6be5a52adda2 |
| OFL-FrankRuhlLibre.txt | https://raw.githubusercontent.com/google/fonts/main/ofl/frankruhllibre/OFL.txt | 4502 | 4e9720b2544d946737e7dfe0027a62c23c7247f0144f08bc437cdcc2e6a7d828 |
| OFL-DavidLibre.txt | https://raw.githubusercontent.com/google/fonts/main/ofl/davidlibre/OFL.txt | 4542 | 01f227b494c348ca8daeeaecbb1e08988b222673ca4bdad1681e49ba4cc8a592 |
| OFL-BodoniModa.txt | https://raw.githubusercontent.com/google/fonts/main/ofl/bodonimoda/OFL.txt | 4400 | 931dfe2e0cd3c9443295f5c1d754b8a8403bf060df50c1d5900267ade83d0046 |
