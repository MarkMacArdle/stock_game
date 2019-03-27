from flask import Flask, flash, jsonify, redirect, render_template, request, session
from flask_session import Session
from datetime import date, timedelta
from os import listdir
import requests
import urllib.parse
from threading import Thread
from random import choice

# Configure application
app = Flask(__name__)

latest_valid_date_str = ''
stocks = {}


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/stocks_and_logos", methods=["GET", "POST"])
def stocks_and_logos():
    """Return a dict of the stocks and their logo pic filename (eg {'AAPL': 'AAPL.png', etc}"""

    return jsonify(stocks_and_logos_json = {i:stocks[i]['logo'] for i in stocks})


@app.route("/quote", methods=["GET"])
def quote():
    """Return percentage change for a stock in a given minute."""

    if request.method == "GET":
        stock = request.args.get('stock')
        minute_of_day = int(request.args.get('minute_of_day'))

        #get change by dividing current minutes stock price by previous minute
        #for first minute of day (minute 0) there's no previous price so just return 0
        #if no trades (volume) happened average price will be -1 and not useable
        #need to check previous minute's volume too as don't want to divide by -1 either
        if (minute_of_day <= 0 
            or minute_of_day > 389 #only 390 minutes in a trading day
            or stocks[stock]['day_data'][minute_of_day]['volume'] == 0
            or stocks[stock]['day_data'][minute_of_day - 1]['volume'] == 0):
            return str(0)
        else:
            return str(stocks[stock]['day_data'][minute_of_day]['average']
                       / stocks[stock]['day_data'][minute_of_day - 1]['average'] - 1)

        #returning as a str instead of float as got a server error when returning the float, not sure why.
        return str(stocks[stock]['day_data'][minute_of_day])


@app.route("/next_stock", methods=["GET", "POST"])
def next_stock():
    """Return a random stock that isn't already on screen."""
    not_on_screen_stocks = [i for i in stocks if not stocks[i]['on_screen']]

    #if no stocks left turn them all to false, prob caused by games restarting without toggling
    if not not_on_screen_stocks:
        for i in stocks:
            stocks[i]['on_screen'] = False
            not_on_screen_stocks.append(i)

    chosen_stock = choice([i for i in stocks if not stocks[i]['on_screen']])
    stocks[chosen_stock]['on_screen'] = True
    return chosen_stock
    

@app.route("/off_screened_stock", methods=["GET"])
def off_screened_stock():
    """Change stock's on_screen boolean to false"""
    if request.method == "GET":
        stock = request.args.get('stock')
        print('off screening:' + stock)
        stocks[stock]['on_screen'] = False

        #returning stock as flask gave error if I didn't return anything or None
        return stock 


@app.route("/trading_day", methods=["GET", "POST"])
def trading_day():
    return latest_valid_date_str 

def get_latest_valid_trading_date():
    """returns date string of last day with a full dataset in the form 20190314"""
    
    #loop back through last 100 days until a valid date is found
    #just chose 100 out of the air as expect to find a valid date by then
    for i in range(100):
        date_str = (date.today() - timedelta(days=i)).strftime("%Y%m%d")
        date_data = requests.get("https://api.iextrading.com/1.0/stock/aapl/chart/date/" + date_str).json()

        #iex api returns empty list for non trading days
        #390 requirement for 390 minutes in a full trading day (wall street trading hours are 09.30 to 16.00)
        #iex starts returning partial days in the middle of a trading day
        if date_data != [] and len(date_data) == 390:
            break
    return date_str


def get_day_data(stock):
    """Get minute by minute percent changes for symbol for last trading day."""

    # Function modified from CS50 Finance project's helper.py file.

    # Contact API
    try:
        url = f"https://api.iextrading.com/1.0/stock/{urllib.parse.quote_plus(stock)}/chart/date/{latest_valid_date_str}"
        print(url)
        response = requests.get(url)
        response.raise_for_status()
    except requests.RequestException:
        return None

    # Parse response
    try:
        stocks[stock]['day_data'] = response.json()
        return 

    except (KeyError, TypeError, ValueError):
        return None



if __name__ == '__main__':

    latest_valid_date_str = get_latest_valid_trading_date()
    stocks_and_logos_dict = {i.split(".")[0]:i for i in listdir("static/assets/stock_logos")}

    #api data will be fetched in parallel on threads
    #how to use threads taken from https://www.shanelynn.ie/using-python-threading-for-multiple-results-queue/
    threads = []

    #get data on all stocks that there is a logo for
    for stock_logo_pic in listdir("static/assets/stock_logos"):
        stock = stock_logo_pic.split(".")[0]

        #on_screen will be flipped as stocks appear and are removed from game screen
        stocks[stock] = {'day_data': {},
                         'logo': stock_logo_pic,
                         'on_screen': False}

        process = Thread(target=get_day_data, args=[stock])
        process.start()
        threads.append(process)

    #threads will only join when they have finished so this makes main thread
    #wait for everything to finish before progressing
    for process in threads:
        process.join()


    app.run(debug = True)


