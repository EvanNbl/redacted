/* eslint-disable @typescript-eslint/no-empty-object-type */
import * as L from "leaflet";

declare module "leaflet" {
  interface MarkerClusterGroupOptions extends L.LayerOptions {
    maxClusterRadius?: number | ((zoom: number) => number);
    iconCreateFunction?: (cluster: MarkerCluster) => L.Icon | L.DivIcon;
    spiderfyOnMaxZoom?: boolean;
    showCoverageOnHover?: boolean;
    zoomToBoundsOnClick?: boolean;
    singleMarkerMode?: boolean;
    disableClusteringAtZoom?: number;
    removeOutsideVisibleBounds?: boolean;
    animate?: boolean;
    animateAddingMarkers?: boolean;
    spiderfyDistanceMultiplier?: number;
    chunkedLoading?: boolean;
  }

  interface MarkerCluster extends L.Marker {
    getChildCount(): number;
    getAllChildMarkers(): L.Marker[];
    getBounds(): L.LatLngBounds;
  }

  class MarkerClusterGroup extends L.FeatureGroup {
    constructor(options?: MarkerClusterGroupOptions);
    addLayer(layer: L.Layer): this;
    removeLayer(layer: L.Layer): this;
    clearLayers(): this;
    getVisibleParent(marker: L.Marker): L.Marker | MarkerCluster;
    refreshClusters(markers?: L.Marker | L.Marker[]): this;
    hasLayer(layer: L.Layer): boolean;
    addLayers(layers: L.Layer[]): this;
    removeLayers(layers: L.Layer[]): this;
  }

  function markerClusterGroup(
    options?: MarkerClusterGroupOptions
  ): MarkerClusterGroup;
}

declare module "leaflet.markercluster" {}
