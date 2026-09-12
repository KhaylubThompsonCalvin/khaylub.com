---
title: Data Science Salaries, a Tableau story
slug: tableau-salary-story
type: story
status: published
date: 2026-09-10
updated: 2026-09-11
summary: A four-point Tableau Public story on 6,599 public salary records, comparing pay by location, job role, experience level, and year, with its own stated limit.
tags: [data-storytelling, tableau]
skills: [data-analysis, visualization]
technologies: [tableau]
employer_visible: true
source: https://public.tableau.com/app/profile/khaylub.thompson/viz/DataScienceSalaryStory/DataScienceSalariesLocationRoleExperienceandTime
question: How do data science salaries differ by location, job role, experience level, and year in one public dataset?
dataset:
  name: Data Science Salaries 2024 (6,599 rows, 11 columns)
  source: Kaggle, kaggle.com/datasets/sazidthe1/data-science-salaries
  license: Public Kaggle dataset; see the dataset page for its terms
story_url: https://public.tableau.com/app/profile/khaylub.thompson/viz/DataScienceSalaryStory/DataScienceSalariesLocationRoleExperienceandTime
result: Location shows the largest spread of the four factors examined, about $115,000 between the highest and lowest country averages; the story states that its year trend describes this dataset, not the wider market.
---

## Question

How do data science salaries differ by location, job role, experience level, and year? The story
answers with one public dataset and says plainly what that dataset can and cannot show.

## Data

Data Science Salaries 2024, a public Kaggle dataset of 6,599 salary records with 11 columns and
no missing values (the author's publication record of 2026-09-10). The story reads the file
directly; no database or server is involved.

## SQL and schema

Not applicable: the workbook connects to a single CSV; Tableau performs the aggregation.

## Method

Built in Tableau from the CSV; four worksheets, one per factor, arranged as a story with captions
that stay within what the data supports. No causal claims are made.

## Result

1. **Location.** The United States average is $157,073 against India at $41,699, a difference of
   about $115,000, the largest spread among the four factors the story examines.
2. **Job role.** Average pay varies widely by job title.
3. **Experience.** In this dataset, average salary rises steadily with experience level.
4. **Time.** The average moves from $102,251 in 2020 to $153,124 in 2024. The story adds its own
   limit: because the number of records differs greatly by year, this trend describes this dataset
   rather than proving a broader market trend.

Figures as published in the story on 2026-09-10 and verified live the same day.

## Notebook

Not applicable: a Tableau story, not a notebook. The published story is the working result.

## Repository

Not applicable: there is no code repository. Read the
[published story on Tableau Public](https://public.tableau.com/app/profile/khaylub.thompson/viz/DataScienceSalaryStory/DataScienceSalariesLocationRoleExperienceandTime),
first published on 2026-09-10 and story-only by choice; a dashboard finale can follow as a revision
over the same address.
