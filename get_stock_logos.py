import requests
import csv

#from iex api
url_start = "https://storage.googleapis.com/iex/api/logos/"

save_file_path = "static/assets/stock_logos/"

with open("static/assets/nasdaq_100_stock_list.csv") as f:
    data = csv.reader(f)
    for row in data:
        png_filename = row[0] + ".png"

        url = "http://craphound.com/images/1006884_2adf8fc7.jpg"
        response = requests.get(url_start + png_filename)

        if response.status_code == 200:
            with open(save_file_path + png_filename, 'wb') as fimg:
                fimg.write(response.content)

