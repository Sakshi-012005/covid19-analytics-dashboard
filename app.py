from flask import Flask, jsonify, render_template
import requests

app = Flask(__name__)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/global")
def api_global():
    try:
        res = requests.get("https://disease.sh/v3/covid-19/all")
        return jsonify(res.json())
    except Exception as e:
        return jsonify({"error": str(e)})

@app.route("/api/countries")
def api_countries():
    try:
        res = requests.get("https://disease.sh/v3/covid-19/countries")
        return jsonify(res.json())
    except Exception as e:
        return jsonify({"error": str(e)})

@app.route("/api/historical/<country>")
def api_historical(country):
    try:
        res = requests.get(f"https://disease.sh/v3/covid-19/historical/{country}?lastdays=30")
        return jsonify(res.json())
    except Exception as e:
        return jsonify({"error": str(e)})

if __name__ == "__main__":
    app.run(debug=True)