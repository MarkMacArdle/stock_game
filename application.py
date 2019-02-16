from flask import Flask, flash, jsonify, redirect, render_template, request, session
from flask_session import Session
import requests
import urllib.parse

# Configure application
app = Flask(__name__)

stock_changes_dict = {}


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/quote", methods=["GET", "POST"])
def quote():
    """Return stock quote."""

    if request.method == "GET":
        stock = request.args.get('stock')
        minute_of_day = int(request.args.get('minute_of_day'))
        return "stock change:" + str(stock_changes_dict[stock][minute_of_day])


# Function taken from CS50 Finance project's helper.py file.
def get_percent_changes(symbol):
    """Get minute by minute percent changes (with 1% = 1.00) for symbol for last trading day."""

    # Contact API
    try:
        response = requests.get(f"https://api.iextrading.com/1.0/stock/{urllib.parse.quote_plus(symbol)}/chart/1d")
        response.raise_for_status()
    except requests.RequestException:
        return None

    # Parse response
    try:
        return [round(x["changeOverTime"]*100, 2) for x in response.json()]

    except (KeyError, TypeError, ValueError):
        return None

#used for testing
stock_changes_dict['AAPL'] = get_percent_changes("AAPL")


# Function taken from CS50 Finance project's helper.py file.
def lookup(symbol):
    """Look up quote for symbol."""

    # Contact API
    try:
        response = requests.get(f"https://api.iextrading.com/1.0/stock/{urllib.parse.quote_plus(symbol)}/quote")
        response.raise_for_status()
    except requests.RequestException:
        return None

    # Parse response
    try:
        quote = response.json()
        return float(quote["latestPrice"])

    except (KeyError, TypeError, ValueError):
        return None



if __name__ == '__main__':
    app.debug = True
    app.run()
    app.run(debug = True)
