---
title: "JavaScript Symbol"
description: "Notes on the Symbol primitive in JavaScript"
type: article
createdAt: 2024-03-15
tags:
  - JavaScript
---

A Symbol is a unique and immutable primitive value introduced in ES2015.

## Creating Symbols

You create a Symbol by calling the Symbol() function. Each call returns a brand-new value.

### Symbol descriptions

The optional description argument is purely diagnostic. Two Symbols with the same description are still distinct.

## Well-known Symbols

The language defines a handful of well-known Symbols, exposed as static properties on Symbol itself.
