#!/bin/sh

jq '.
# Make statistic duration optional
| .definitions["Statistics"].required = []

# And code as well because sometimes, it just aint there (e.g. web stuff)
| .definitions["Exec_JSON_Control"].required -= ["code"]
' <&0