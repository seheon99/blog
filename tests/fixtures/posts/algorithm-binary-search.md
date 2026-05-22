---
title: "Binary search invariants"
description: "Loop invariants that keep binary search correct on every iteration"
type: article
createdAt: 2023-11-04
tags:
  - Algorithm
---

The classic binary-search loop maintains two invariants: the target, if present, lies in the half-open interval `[lo, hi)`, and `lo <= hi` at every step.
