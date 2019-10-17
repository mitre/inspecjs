#!/bin/sh

jq '.
# Make statistic duration optional
| .definitions["Statistics"].required = []
' <&0