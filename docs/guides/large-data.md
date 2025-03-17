# Optimising Mapmetrics Performance: Tips for Large GeoJSON Datasets

Performance is a critical aspect of providing users with a smooth and responsive experience. This guide focuses on techniques for improving the performance of Mapmetrics, particularly when dealing with large datasets in GeoJSON format. We'll categorise our strategies into two key areas:

1. Loading the data
1. Visualizing the data

## Loading the Data

## Visualising the Data

Once the data is loaded, to ensure a smooth user experience, it's essential to optimise how you visualise the data on the map.

### Cluster

One simple approach is to visualise fewer points. If we are using a GeoJSON source (i.e. not vector tiles), we can use 'clustering' to group nearby points together. This approach reduces the number of features displayed on the map, improving rendering performance and maintaining map readability.

```javascript
map.addSource("earthquakes", {
    type: "geojson",
    data: "https://gateway.mapmetrics.org/assets/earthquakes.geojson",
    cluster: true,
    clusterMaxZoom: 14, // Max zoom to cluster points on
    clusterRadius: 50, // Radius of each cluster when clustering points (defaults to 50)
});
```

You can see a full example here: [Create and style clusters](https://atlasdocs.mapmetrics.org/overview/sdk/examples/add-a-cluster.html).

### Simplify Styling

Complex and intricate map styles can slow down rendering, especially when working with large datasets. Simplify your map styles by reducing the number of layers, symbols, and complex features, and use simpler symbology where appropriate.

### Zoom Levels

Optimising your zoom levels ensures that the map loads efficiently and displays the right level of detail at different zoom levels, contributing to a smoother user experience.

#### Max Zoom Level

To improve map performance during panning and zooming, set the maxZoom option on your GeoJSON source to a value lower than the default 22. For most point sources, a maxZoom value of 12 strikes a good balance between precision and speed.

#### Min Zoom Level

Adjust the minZoom property on the layer that references the GeoJSON source to a value greater than 0. This setting prevents the map from attempting to load and render tiles at low zoom levels, which is often unnecessary because there aren't enough screen pixels to display every feature of a large dataset. By adjusting the minZoom property, you'll achieve a faster map load and improved rendering performance.

You can implement them both as follows:

```javascript
let map = new mapmetricsgl.Map({
    container: "map",
    maxZoom: 12,
    minZoom: 5,
});
```
