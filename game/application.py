from flask import Flask, flash, jsonify, redirect, render_template, request, session
from flask_session import Session
from datetime import date, timedelta, datetime
from os import listdir, path
import requests
import urllib.parse
from threading import Thread
from random import choice
import pymongo
import mongodb_config


app = Flask(__name__)
db = pymongo.MongoClient(mongodb_config.connect_str)["main"]
latest_valid_date_str = ''
stocks = {}


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/stocks_and_logos", methods=["GET", "POST"])
def stocks_and_logos():
    """Return a dict of the stocks and their logo pic filename 
    (eg {'AAPL': 'AAPL.png', etc}"""

    # Make sure data is up to date
    update_stock_day_and_data()

    return jsonify(
        stocks_and_logos_json = {i:stocks[i]['logo'] for i in stocks}
    )


@app.route("/quote", methods=["GET"])
def quote():
    """Return percentage change for a stock in a given minute."""

    if request.method == "GET":
        stock = request.args.get('stock')
        minute_of_day = int(request.args.get('minute_of_day'))

        # Get change by dividing the current minute's stock price by previous 
        # minute's. For first minute of day (minute 0) there's no previous price
        # so just return 0
        # If no trades (volume) happened average price will be -1 and not 
        # useable. Need to check previous minute's volume too as don't want to 
        # divide by -1 either
        if (minute_of_day <= 0 
            or minute_of_day > 389 #only 390 minutes in a trading day
            or stocks[stock]['day_data'][minute_of_day]['volume'] == 0
            or stocks[stock]['day_data'][minute_of_day - 1]['volume'] == 0):
            return str(0)
        else:
            return str(stocks[stock]['day_data'][minute_of_day]['average']
                       / stocks[stock]['day_data'][minute_of_day - 1]['average']
                       - 1)

        # Returning as a str instead of float as got a server error when 
        # returning the float, not sure why.
        return str(stocks[stock]['day_data'][minute_of_day])


@app.route("/next_stock", methods=["GET"])
def next_stock():
    """Return a random stock that isn't already on screen."""
    
    if request.method == "GET":
        current_stocks = request.args.get('current_stocks_str')
        print('current_stocks type:', type(current_stocks), 'content:', current_stocks)
        if current_stocks is None:
            current_stocks = []

        return choice([i for i in stocks if i not in current_stocks])


@app.route("/trading_day", methods=["GET", "POST"])
def trading_day():
    return latest_valid_date_str 


@app.route("/placing", methods=["GET"])
def placing():
    """Return placing of a given score on the leaderboard as a string"""

    if request.method == "GET":
        score_points = int(request.args.get('score_points'))

        placing = str(
            db.highscores.find({"score_points":{"$gt":score_points}}).count() 
            + 1
        )

        if placing == '11' or placing == '12' or placing == '13':
            placing += 'th'
        elif placing[-1] == '1':
            placing += 'st'
        elif placing[-1] == '2':
            placing += 'nd'
        elif placing[-1] == '3':
            placing += 'rd'
        else:
            placing += 'th'

        if db.highscores.find(
            {"score_points":{"$eq":score_points}}).count() > 0:
            placing = placing + ' (joint)'

        return placing


@app.route("/save_score", methods=["GET"])
def save_score():
    """Add entry for score to database"""

    if request.method == "GET":
        score_points = int(request.args.get('score_points'))
        score_money = int(request.args.get('score_money'))

        db.highscores.insert_one({"score_points": score_points, 
                                  "score_money": score_money,
                                  "created_at": datetime.now()})

        # Returning empty string to avoid Flask throwing an error
        return ''


def get_latest_valid_trading_date():
    """returns date string of last day with a full dataset in the form 
    20190314"""
    
    # Loop back through last 100 days until a valid date is found
    # Just chose 100 out of the air as expect to find a valid date by then
    for i in range(100):
        date_str = (date.today() - timedelta(days=i)).strftime("%Y%m%d")
        date_data = requests.get(
            "https://api.iextrading.com/1.0/stock/aapl/chart/date/" 
            + date_str).json()

        # IEX api returns empty list for non trading days
        # 390 requirement for 390 minutes in a full trading day (wall street 
        # trading hours are 09.30 to 16.00). Need to test as IEX starts
        # returning partial days in the middle of a trading day.
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


def update_stock_day_and_data():
    """checks if data for a new day is available and updates stock data if so"""

    global latest_valid_date_str
    global stocks

    if latest_valid_date_str != get_latest_valid_trading_date():
        latest_valid_date_str = get_latest_valid_trading_date()

        # Api data will be fetched in parallel on threads
        # How to use threads taken from:
        # https://www.shanelynn.ie/using-python-threading-for-multiple-results-queue/
        threads = []

        # Get data on all stocks that there is a logo for
        for stock_logo_pic in listdir(path.dirname(path.realpath(__file__)) 
                                      + "/static/assets/stock_logos"):

            stock = stock_logo_pic.split(".")[0]

            stocks[stock] = {'day_data': {},
                             'logo': stock_logo_pic}

            process = Thread(target=get_day_data, args=[stock])
            process.start()
            threads.append(process)

        # Threads will only join when they have finished so this makes main 
        # thread wait for everything to finish before progressing
        for process in threads:
            process.join()

    return None



if __name__ == '__main__':
    update_stock_day_and_data()


    app.run(debug=False, host='0.0.0.0')


