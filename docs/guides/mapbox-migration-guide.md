# MapBox migration guide

This part of the docs is dedicated to the migration from `mapbox-gl` to `mapmetrics-gl`.

This guide might not be accurate depending on the current version of `mapbox-gl` but should be fairly straight forward.

The libraries are very similar but diverge with newer features happening from v2 in both libraries where Mapbox turned proprietary.

The overall migration happens by uninstalling `mapbox-gl` and installing `mapmetrics-gl` in your node packages (or see below for CDN links), and replacing `mapboxgl` with `mapmetricsgl` throughout your TypeScript, JavaScript and HTML/CSS.

```diff
-    var map = new mapboxgl.Map({
+    var map = new mapmetricsgl.Map({

-    <button class="mapboxgl-ctrl">
+    <button class="mapmetricsgl-ctrl">
```

#### Compatibility branch

Mapmetrics GL JS is completely backward compatible with Mapbox GL JS. This compatibility branch (named 1.x) is tagged on npm.

#### CDN Links

```diff
-    <script src="https://api.mapbox.com/mapbox-gl-js/v#.#.#/mapbox-gl.js"></script>
-    <link
-      href="https://api.mapbox.com/mapbox-gl-js/v#.#.#/mapbox-gl.css"
-      rel="stylesheet"
-    />


+    <script src="https://gateway.mapmetrics.org/assets/js/mapmetrics-gl.js"></script>
+    <link
+      href="https://gateway.mapmetrics.org/assets/css/mapmetrics-gl.css"
+      rel="stylesheet"
+    />

```
