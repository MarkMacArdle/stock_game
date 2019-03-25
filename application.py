from flask import Flask, flash, jsonify, redirect, render_template, request, session
from flask_session import Session
from datetime import date, timedelta
from os import listdir
import requests
import urllib.parse

# Configure application
app = Flask(__name__)

stock_changes_dict = {}
latest_valid_date_str = ''

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/stocks_and_logos", methods=["GET", "POST"])
def stocks_and_logos():
    """Return a dict of the stocks and their logo pic filename"""
    print("stocks_and_logos() called")
    stocks_and_logos_dict = {i.split(".")[0]:i for i in listdir("static/assets/stock_logos")}
    return jsonify(stocks_and_logos_json = stocks_and_logos_dict)


@app.route("/quote", methods=["GET", "POST"])
def quote():
    """Return stock quote."""

    if request.method == "GET":
        stock = request.args.get('stock')
        print("stock:" + stock)
        minute_of_day = int(request.args.get('minute_of_day'))

        if stock not in stock_changes_dict:
            print("not in dict")
            stock_changes_dict[stock] = get_day_data(stock)

        #get change
        #if no trades happened average price will be -1 and not useable
        if (minute_of_day == 0 
            or stock_changes_dict[stock][minute_of_day]['volume'] == 0
            or stock_changes_dict[stock][minute_of_day - 1]['volume'] == 0):
            return str(0)
        else:
            return str(stock_changes_dict[stock][minute_of_day]['average']
                       /stock_changes_dict[stock][minute_of_day - 1]['average'] - 1)

        #returning as a str instead of float as got a server error when returning the float, not sure why.
        return str(stock_changes_dict[stock][minute_of_day])


def get_latest_valid_trading_date():
    for i in range(100):
        date_str = (date.today() - timedelta(days=i)).strftime("%Y%m%d")
        if requests.get("https://api.iextrading.com/1.0/stock/aapl/chart/date/" + date_str).json() != []:
            break
    return date_str


def get_day_data(symbol):
    """Get minute by minute percent changes  for symbol for last trading day."""
    # Function taken from CS50 Finance project's helper.py file.

    # Contact API
    try:
        print("latest_valid_date_str: " + latest_valid_date_str)
        print(f"https://api.iextrading.com/1.0/stock/{urllib.parse.quote_plus(symbol)}/chart/date/{latest_valid_date_str}")
        response = requests.get(f"https://api.iextrading.com/1.0/stock/{urllib.parse.quote_plus(symbol)}/chart/date/{latest_valid_date_str}")
        response.raise_for_status()
    except requests.RequestException:
        return None

    # Parse response
    try:
        return response.json()

    except (KeyError, TypeError, ValueError):
        return None


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
    latest_valid_date_str = get_latest_valid_trading_date()

    app.debug = True
    app.run()
    app.run(debug = True)
