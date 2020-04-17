#!/bin/bash
sudo $1 &

trap 'kill $(jobs -p)' SIGUSR1
trap 'kill $(jobs -p)' EXIT

while true
do
  wait
done