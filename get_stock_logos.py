import requests
import csv

#from iex api
#url_start = "https://storage.googleapis.com/iex/api/logos/"
url_start = "https://www.nasdaq.com/logos/"

save_file_path = "static/assets/stock_logos/"

with open("static/assets/nasdaq_100_stock_list.csv") as f:
    data = csv.reader(f)
    for row in data:
        #filename = row[0] + ".png"
        filename = row[0] + ".gif"

        response = requests.get(url_start + filename)

        if response.status_code == 200:
            with open(save_file_path + filename, 'wb') as fimg:
                fimg.write(response.content)

