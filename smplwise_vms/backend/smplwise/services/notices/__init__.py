"""CR-NOTICE106 - the building notice board: notices, audiences, TV boards (docs/changes/CR-NOTICE106.md).

model.py     - limits, the derived state, the display settings of a board (section 8.4) and the module settings (section 11)
store.py     - the tables of migration 0160 (provisional number)
audience.py  - who a notice is for (section 5) and the reading test
display.py   - the TV feed and the tokenised display routes (section 4.1 / 8.3), shared by the main app and the LAN listener
sources.py   - the optional weather (the installation's weather entity) and news (server-side RSS) blocks of the feed
listener.py  - the optional LAN listener for the TVs (container port 18094, add-on option `notice_boards`)
"""
