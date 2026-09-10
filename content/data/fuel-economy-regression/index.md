---
title: Fuel Economy Regression Case Study
slug: fuel-economy-regression
type: analysis
status: published
date: 2026-08-30
updated: 2026-09-09
summary: What predicts a car's fuel economy? A regression case study on the public Auto MPG dataset, reproducible from a clean clone.
tags: [python, regression, reproducibility, data-storytelling]
skills: [data-analysis, data-cleaning, regression-modeling, visualization, reproducible-research]
technologies: [python, pandas, scikit-learn, matplotlib, seaborn, jupyterlab]
employer_visible: true
featured: true
source: https://github.com/KhaylubThompsonCalvin/fuel-economy-analysis
question: What vehicle characteristics predict fuel economy, and how well?
dataset:
  name: Auto MPG (398 vehicles)
  source: Carnegie Mellon StatLib, via the UCI Machine Learning Repository and the seaborn-data mirror
  license: Public dataset; see the repository README for the exact terms
repository: https://github.com/KhaylubThompsonCalvin/fuel-economy-analysis
result: Regression models explain 79 percent of the variation in fuel economy on unseen test data; the README states what the model cannot claim.
links:
  code: https://github.com/KhaylubThompsonCalvin/fuel-economy-analysis
  result: https://github.com/KhaylubThompsonCalvin/fuel-economy-analysis#readme
related: [sql-python-analytics-pipeline]
---

## Question

What vehicle characteristics predict fuel economy, and how well can a linear model do it?

## Data

The public Auto MPG dataset: 398 vehicles with weight, horsepower, displacement, model year, and origin. Provenance runs from Carnegie Mellon's StatLib to the UCI repository to the seaborn-data mirror used here.

## Method

Cleaning first, including correcting eight misspelled manufacturer names that would have split brands across the results. Then correlation, a train and test split, linear regression, and residual diagnostics. Every figure in the repository came out of an executed notebook cell.

## Result

The models explain 79 percent of the variation in fuel economy on unseen test data. The README also says what the model cannot claim.

## Notebook and repository

The notebook, the four published figures, and the reproduction steps are in the repository linked at the top of this page. A clean-room re-run from an empty data folder reproduced every published figure. The rendered notebook is embedded on this page at Phase 11.
