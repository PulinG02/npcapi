const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const PROJECT_ID = "vxnpc-667e4";
const API_KEY = "AIzaSyA37DP87axf_GCxLUyjQdCIyxfbiBH1rTo";

app.post("/checkKey", async (req, res) => {
  const { user_key, serial } = req.body;
  if (!user_key) return res.json({ status: "error", reason: "No key provided." });

  try {
    const fetch = (...args) => import("node-fetch").then(({default: f}) => f(...args));
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/keys/${user_key}?key=${API_KEY}`;
    const r = await fetch(url);
    const data = await r.json();

    if (!data.fields) return res.json({ status: "error", reason: "Key not found." });

    const expiry = data.fields.expiry?.stringValue || "";
    const max_devices = parseInt(data.fields.max_devices?.integerValue || data.fields.max_devices?.stringValue || 1);
    const devices = data.fields.devices?.arrayValue?.values?.map(v => v.stringValue) || [];
    const today = new Date().toISOString().split("T")[0];

    if (expiry < today) return res.json({ status: "error", reason: "Key expired." });

    const alreadyConnected = devices.includes(serial);

    if (!alreadyConnected) {
      if (max_devices < 999 && devices.length >= max_devices) {
        return res.json({ status: "error", reason: "Max devices reached (" + devices.length + "/" + max_devices + ")" });
      }
      devices.push(serial);
      const patchUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/keys/${user_key}?key=${API_KEY}&updateMask.fieldPaths=devices&updateMask.fieldPaths=used_by`;
      await fetch(patchUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: {
            used_by: { stringValue: serial },
            devices: { arrayValue: { values: devices.map(d => ({ stringValue: d })) } }
          }
        })
      });
    }

    return res.json({
      status: "success",
      data: {
        expired_date: expiry,
        devices: devices.length,
        max_devices: max_devices
      }
    });

  } catch (e) {
    return res.json({ status: "error", reason: "Server error." });
  }
});

app.get("/", (req, res) => res.send("NPC API Online"));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Running on port " + PORT));
