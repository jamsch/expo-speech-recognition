#!/bin/bash

# This script downloads a file from the connected device using adb
filePath=$1
# remove "file://" prefix
filePath=${filePath#file://}

adb -d shell "run-as expo.modules.speechrecognition.example cat $filePath"