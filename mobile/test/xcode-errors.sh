#!/bin/sh
# Prints the useful part of a failed xcodebuild log: every error with the lines around it, script-phase output
# and the list of failed commands (the full log is thousands of lines of compiler commands).
#   sh test/xcode-errors.sh <xcodebuild.log>
LOG="$1"
echo "=== xcodebuild failed; errors (full log: $(wc -l < "$LOG") lines)"
grep -n -B4 -A12 -E '(^|[^a-z])error:|\*\* (BUILD|ARCHIVE) FAILED|Command PhaseScriptExecution failed|fatal error' "$LOG" | grep -v -E '^[0-9]+-\s+/Applications/Xcode.*clang ' | head -400
echo "=== script phase output"
awk '/^PhaseScriptExecution/{p=1;n=0} p{print; n++} n>60{p=0}' "$LOG" | grep -v '^    export ' | tail -150
echo "=== failed commands"
sed -n '/The following build commands failed/,$p' "$LOG" | head -20
