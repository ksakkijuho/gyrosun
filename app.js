const STORAGE_KEY = "sun-compass-v1";

const defaults = {
  latitude: 62.892,
  longitude: 27.678,
  calibrationOffset: 0
};

let settings = loadSettings();
let deviceHeading = null;
let orientationEnabled = false;
let locationState = "not started";
let selectedDate = new Date();
let selectedMinutes = selectedDate.getHours() * 60 + selectedDate.getMinutes();
let playing = false;
let playTimer = null;

const $ = id => document.getElementById(id);

function loadSettings() {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(STORAGE_KEY)) };
  } catch {
    return { ...defaults };
  }
}

function saveSettings() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function normalize(deg) {
  return ((deg % 360) + 360) % 360;
}

function formatAngle(deg) {
  return `${Math.round(normalize(deg))}°`;
}

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(date) {
  return date.toLocaleDateString([], { weekday: "short", year: "numeric", month: "short", day: "numeric" });
}

function getSelectedDateTime() {
  const d = new Date(selectedDate);
  d.setHours(Math.floor(selectedMinutes / 60), selectedMinutes % 60, 0, 0);
  return d;
}

function updateSolarData() {
  const date = getSelectedDateTime();
  const pos = SunCalc.getPosition(date, settings.latitude, settings.longitude);
  const azimuth = normalize(pos.azimuth * 180 / Math.PI + 180);
  const altitude = pos.altitude * 180 / Math.PI;
  const times = SunCalc.getTimes(date, settings.latitude, settings.longitude);

  $("timeValue").textContent = formatTime(date);
  $("dateValue").textContent = formatDate(date);
  $("locationValue").textContent = `${settings.latitude.toFixed(4)}, ${settings.longitude.toFixed(4)}`;
  $("azimuthValue").textContent = formatAngle(azimuth);
  $("altitudeValue").textContent = `${altitude.toFixed(1)}°`;
  $("sunriseValue").textContent = validDate(times.sunrise) ? formatTime(times.sunrise) : "—";
  $("sunsetValue").textContent = validDate(times.sunset) ? formatTime(times.sunset) : "—";

  updateSunMarker(azimuth, altitude);

  $("timeSlider").value = selectedMinutes;
}

function validDate(d) {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

function updateSunMarker(azimuth, altitude) {
  const referenceHeading = deviceHeading === null ? 0 : deviceHeading;
  const relativeAzimuth = normalize(azimuth - referenceHeading);

  // Horizontal projection: 0° = straight ahead, ±90° = sides, 180° = behind.
  const radius = 38;
  const angle = relativeAzimuth * Math.PI / 180;
  const x = 50 + Math.sin(angle) * radius;
  const verticalAngle = Math.max(-90, Math.min(90, altitude));
  const y = 50 - Math.cos(angle) * (radius * 0.75) - verticalAngle * 0.20;

  $("sunMarker").style.left = `${x}%`;
  $("sunMarker").style.top = `${Math.max(8, Math.min(92, y))}%`;

  $("sunMarkerLabel").textContent =
    altitude < -0.8 ? "Below horizon" : `${altitude.toFixed(1)}°`;
}

function updateHeading(heading) {
  const calibrated = normalize(heading + Number(settings.calibrationOffset || 0));
  if (deviceHeading !== null) {
    const delta = Math.abs(normalize(calibrated - deviceHeading + 180) - 180);
    if (delta < 0.15) return;
  }
  deviceHeading = calibrated;
  $("headingValue").textContent = formatAngle(deviceHeading);
  $("status").textContent = locationState === "active"
    ? `GPS + orientation active · heading ${formatAngle(deviceHeading)}`
    : `Orientation active · heading ${formatAngle(deviceHeading)}`;
  updateSunMarker(getSunAzimuth(), getSunAltitude());
}

function getSunPosition() {
  return SunCalc.getPosition(getSelectedDateTime(), settings.latitude, settings.longitude);
}

function getSunAzimuth() {
  return normalize(getSunPosition().azimuth * 180 / Math.PI + 180);
}

function getSunAltitude() {
  return getSunPosition().altitude * 180 / Math.PI;
}

function handleOrientation(event) {
  let heading = null;

  // iOS Safari commonly exposes this directly.
  if (typeof event.webkitCompassHeading === "number" && event.webkitCompassHeading >= 0) {
    heading = event.webkitCompassHeading;
  } else if (event.absolute && typeof event.alpha === "number") {
    // For absolute orientation, alpha is generally clockwise from north
    // when using the standard device coordinate convention.
    heading = 360 - event.alpha;
  } else if (typeof event.alpha === "number") {
    // Best-effort fallback for browsers that don't expose an absolute heading.
    heading = 360 - event.alpha;
    $("status").textContent = "Orientation active · relative sensor mode";
  }

  if (heading !== null) updateHeading(heading);
}

function startLocation() {
  if (!navigator.geolocation) {
    locationState = "unsupported";
    $("status").textContent = "Phone location is not supported by this browser.";
    return;
  }
  locationState = "requesting";
  $("status").textContent = "Requesting phone location…";
  navigator.geolocation.watchPosition(
    position => {
      settings.latitude = position.coords.latitude;
      settings.longitude = position.coords.longitude;
      locationState = "active";
      saveSettings();
      updateSolarData();
      if (deviceHeading !== null) {
        $("status").textContent = `GPS + orientation active · heading ${formatAngle(deviceHeading)}`;
      }
    },
    error => {
      locationState = "error";
      const messages = {1:"Location permission was denied.",2:"Phone location is unavailable.",3:"Location request timed out."};
      $("status").textContent = messages[error.code] || "Could not get phone location.";
    },
    { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 }
  );
}

async function enableOrientation() {
  try {
    if (typeof DeviceOrientationEvent === "undefined") {
      throw new Error("Device orientation is not supported by this browser.");
    }

    if (typeof DeviceOrientationEvent.requestPermission === "function") {
      const permission = await DeviceOrientationEvent.requestPermission();
      if (permission !== "granted") {
        throw new Error("Motion/orientation permission was not granted.");
      }
    }

    window.addEventListener("deviceorientationabsolute", handleOrientation, true);
    window.addEventListener("deviceorientation", handleOrientation, true);

    orientationEnabled = true;
    $("orientationButton").textContent = "Orientation enabled";
    $("orientationButton").disabled = true;
    $("status").textContent = "Waiting for orientation sensor…";
  } catch (error) {
    $("status").textContent = error.message;
  }
}

function setNow() {
  const now = new Date();
  selectedDate = now;
  selectedMinutes = now.getHours() * 60 + now.getMinutes();
  updateSolarData();
}

function startStopPlay() {
  playing = !playing;
  $("playButton").textContent = playing ? "❚❚ Pause" : "▶ Play";

  if (!playing) {
    clearInterval(playTimer);
    playTimer = null;
    return;
  }

  playTimer = setInterval(() => {
    selectedMinutes += 5;
    if (selectedMinutes > 1439) selectedMinutes = 0;
    updateSolarData();
  }, 120);
}

$("orientationButton").addEventListener("click", enableOrientation);
$("nowButton").addEventListener("click", setNow);
$("todayButton").addEventListener("click", () => {
  selectedDate = new Date();
  selectedDate.setHours(12, 0, 0, 0);
  updateSolarData();
});
$("playButton").addEventListener("click", startStopPlay);

$("timeSlider").addEventListener("input", e => {
  selectedMinutes = Number(e.target.value);
  updateSolarData();
});

$("settingsButton").addEventListener("click", () => {
  $("latitudeInput").value = settings.latitude;
  $("longitudeInput").value = settings.longitude;
  $("offsetInput").value = settings.calibrationOffset;
  $("settingsDialog").showModal();
});

$("settingsForm").addEventListener("submit", event => {
  event.preventDefault();

  settings.latitude = Number($("latitudeInput").value);
  settings.longitude = Number($("longitudeInput").value);
  settings.calibrationOffset = Number($("offsetInput").value) || 0;

  saveSettings();
  $("settingsDialog").close();
  updateSolarData();

  if (deviceHeading !== null) updateHeading(deviceHeading);
});

setNow();
startLocation();
