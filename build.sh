#!/bin/bash
set -e
rm -rf dist
mkdir -p dist
cp index.html dist/index.html
cp -r src dist/src
cp -r asset dist/asset
