---
title: "Seattle Crash Analysis"
description: "A Jupyter Notebook spatial analysis of crash hotspots and acute-care hospital access in Seattle."
date: 2026-09-06
image: /maps/seattle-crash-analysis.png
externalUrl: https://colab.research.google.com/drive/1D2yfs-uQz5RQk-nUeHg7iRcxiFm1wdDR?usp=sharing
sourceUrl: https://github.com/ameliarowland/seattle-crash-analysis
tallEmbed: true
contentType: notebook
tools: [Python, Jupyter, pandas, seaborn, Matplotlib, scikit-learn, HDBSCAN, QGIS]
tags: [spatial-data-science, traffic-safety, public-health, clustering, reproducible-analysis]
---

This project investigates whether Seattle's most serious crash hotspots coincide with gaps in acute-care hospital access. The work began as a spatial data science case study presented in January 2025 and combines exploratory analysis in a [Jupyter Notebook](https://jupyter.org/) with a broader cartographic and network-analysis workflow in [QGIS](https://qgis.org/).

## Preparing the analysis

The Jupyter Notebook starts with the Python libraries used for tabular data handling, statistical visualization, clustering, and geospatial exploration.

```python
from ipyleaflet import Map, basemaps, GeoJSON
from matplotlib.colors import LinearSegmentedColormap, to_rgba
from sklearn.cluster import HDBSCAN
import seaborn
import pandas
import numpy as np
import matplotlib.pyplot as plt
```

The analysis uses filtered [Seattle Department of Transportation collision records](https://data-seattlecitygis.opendata.arcgis.com/datasets/sdot-collisions-all-years) from 2014–2024 and [Seattle acute-care hospital locations](https://data-seattlecitygis.opendata.arcgis.com/datasets/SeattleCityGIS::hospitals-2/explore). I load the projected coordinates with [pandas](https://pandas.pydata.org/docs/), then use [seaborn](https://seaborn.pydata.org/) and [Matplotlib](https://matplotlib.org/stable/) to plot crash locations in black and hospital locations in red.

```python
# Load and display data points

# formatting
plt.rcParams['axes.facecolor'] = 'grey'

# load filtered crash data points
crash_data = pandas.read_csv('./SDOT_Collisions_filtered.csv', header=0)
crash_plot = seaborn.scatterplot(data=crash_data, x="x", y="y", color="black", label="Crash")
plt.title("Seattle Crashes from 2014-2024")

# load hospital data points
hospital_data = pandas.read_csv('./Hospitals_seattle_acute.csv', header=0)
crash_plot = seaborn.scatterplot(data=hospital_data, x="x", y="y", color="red", label="Hospital")
```

![Seattle crash locations and acute-care hospitals](/maps/seattle-crash-analysis/02-crash-and-hospitals.png)

## Revealing the overall distribution

A two-dimensional [seaborn distribution plot](https://seaborn.pydata.org/generated/seaborn.displot.html) turns the individual points into a density view. This first pass makes the broad concentrations of reported crashes easier to distinguish than the raw scatterplot alone.

```python
# Heatmap visualization via Distribution Plot (displot) analysis

# formatting
plt.rcParams['axes.facecolor'] = 'grey'

# create displot
crash_displot = seaborn.displot(
    data=crash_data,
    x="x",
    y="y",
    cmap="gnuplot2",
    cbar=True
)

# add title
plt.title("Distribution Plot - Seattle Crashes from 2014-2024")
```

![Two-dimensional distribution plot of Seattle crashes](/maps/seattle-crash-analysis/03-distribution-plot.png)

*The two-dimensional distribution reveals the strongest overall concentrations of crashes.*

## Testing kernel density parameters

The first [kernel density estimation](https://seaborn.pydata.org/generated/seaborn.kdeplot.html) uses a narrow bandwidth of `0.15` and 30 contour levels. This preserves more local variation and produces a detailed view of smaller hotspots.

```python
# Visualize hotspots with Kernel density estimation (KDE) analysis

# create KDE plot
crash_kde = seaborn.kdeplot(
    data=crash_data,
    x="x",
    y="y",
    cmap="gnuplot2",
    bw_adjust=0.15,  # Adjusts bandwidth
    levels=30,
    fill=True,
    cbar=True
)

# add title
plt.title("KDE for Seattle Crashes from 2014-2024")

# documentation for reference
# https://seaborn.pydata.org/generated/seaborn.kdeplot.html
# https://matplotlib.org/stable/users/explain/colors/colormaps.html
```

![Detailed kernel density estimate of Seattle crashes](/maps/seattle-crash-analysis/04-kde-detailed.png)

*A narrow bandwidth and 30 contour levels preserve smaller, localized hotspots.*

I then increase the bandwidth to `0.3` and reduce the visualization to five contour levels. The smoother result suppresses fine detail and makes the wider citywide pattern easier to read. Showing both cells makes the analytical effect of the parameter choice explicit.

```python
# Adjust parameters for KDE analysis

# create KDE plot
crash_kde_adjusted = seaborn.kdeplot(
    data=crash_data,
    x="x",
    y="y",
    cmap="gnuplot2",
    bw_adjust=0.3,  # Adjusts bandwidth
    levels=5,
    fill=True,
    cbar=True
)

# add title
plt.title("KDE for Seattle Crashes from 2014-2024")

# documentation for reference
# https://seaborn.pydata.org/generated/seaborn.kdeplot.html
# https://matplotlib.org/stable/users/explain/colors/colormaps.html
```

![Smoothed kernel density estimate of Seattle crashes](/maps/seattle-crash-analysis/05-kde-smoothed.png)

*The wider bandwidth and five contour levels emphasize the broader spatial pattern.*

## Finding clusters with [HDBSCAN](https://scikit-learn.org/stable/modules/generated/sklearn.cluster.HDBSCAN.html)

For cluster detection, I use [HDBSCAN](https://scikit-learn.org/stable/modules/generated/sklearn.cluster.HDBSCAN.html) from [scikit-learn](https://scikit-learn.org/stable/). The first model groups the wider crash dataset with a minimum cluster size of 300. After fitting the model, I separate clusters from observations labeled as noise, retain the noise points as a gray reference layer, and vary cluster color so they are differentiable.

```python
# identify clusters via HDBSCAN analysis

plt.figure(figsize=(6, 7))

# convert csv to dataframe
crash_df = pandas.DataFrame(
    crash_data,
    columns=['x','y']
)
crash_df = crash_df.dropna()

clustering = HDBSCAN(min_cluster_size=300).fit(crash_df)
cluster_labels = clustering.labels_
crash_df["cluster_labels"] = cluster_labels

# hide noise datapoints
crash_df_quiet = crash_df[crash_df.cluster_labels >= 0]

# display all points for reference
crash_cluster_plot = seaborn.scatterplot(
    data=crash_df,
    x="x", y="y", color="grey"
)
crash_cluster_plot = seaborn.scatterplot(
    data=crash_df_quiet,
    x="x", y="y",
    hue='cluster_labels',
    palette="tab20" # force categorical coloring for numeric cluster_labels
)

# add title
plt.title("HDBSCAN for Seattle Crashes from 2014-2024")
```

![HDBSCAN clusters for the wider Seattle crash dataset](/maps/seattle-crash-analysis/06-hdbscan-all-crashes.png)

*[HDBSCAN](https://scikit-learn.org/stable/modules/generated/sklearn.cluster.HDBSCAN.html) separates dense crash clusters from observations treated as noise.*

The second model focuses only on crashes involving serious injuries or fatalities and lowers the minimum cluster size to 30. Overlaying the acute-care hospitals creates a direct visual comparison between high-severity crash clusters and the mapped medical infrastructure.

```python
# identify clusters via HDBSCAN analysis

crash_serious = pandas.read_csv('./SDOT_Collisions_filtered_fatalities_serious_injuries.csv', header=0)

plt.figure(figsize=(12, 10))

# convert csv to dataframe
crash_serious_df = pandas.DataFrame(
    crash_serious,
    columns=['x','y']
)
crash_serious_df = crash_serious_df.dropna()

clustering_s = HDBSCAN(min_cluster_size=30).fit(crash_serious_df)
cluster_s_labels = clustering_s.labels_
crash_serious_df["cluster_labels"] = cluster_s_labels

# hide noise datapoints
crash_s_df_quiet = crash_serious_df[crash_serious_df.cluster_labels >= 0]

# display all points for reference
crash_s_cluster_plot = seaborn.scatterplot(
    data=crash_serious_df,
    x="x", y="y", color="grey"
)
crash_s_cluster_plot = seaborn.scatterplot(
    data=crash_s_df_quiet,
    x="x", y="y",
    hue='cluster_labels',
    palette="tab20" # force categorical coloring for numeric cluster_labels
)

crash_s_cluster_plot = seaborn.scatterplot(
    data=hospital_data,
    x="x", y="y", color="black", label="Hospital"
)

# add title
plt.title("HDBSCAN for Seattle Crashes with Serious Injuries & Fatalities from 2014-2024")
```

![HDBSCAN clusters for serious-injury and fatal Seattle crashes with hospitals](/maps/seattle-crash-analysis/07-hdbscan-serious-crashes.png)

*The focused model compares severe-crash clusters with the distribution of acute-care hospitals.*

## Interpreting the result

The saved output highlights a serious-crash cluster in southeast Seattle that is comparatively distant from the mapped hospital locations. In the accompanying presentation, this observation became the focus for a [QGIS](https://qgis.org/) choropleth and [road-network analysis](https://docs.qgis.org/3.34/en/docs/user_manual/processing_algs/qgis/networkanalysis.html), with Rainier Valley identified as an area for closer study.

The workflow demonstrates how I move from geospatially referenced tabular data to progressively more focused questions: cleaning missing coordinates, comparing visualization parameters, fitting density-based clustering models, suppressing model noise for interpretation, and layering contextual point data over analytical results.

The analysis is exploratory. Geographic accuracy, hospital capacity and specialization, road travel conditions, and emergency response times all affect the real-world question, so proximity alone should not be read as proof of health-care adequacy. Those limitations point to the most valuable next steps: network-based travel times, real-time traffic conditions, and a more specific analysis of social determinants of health.
