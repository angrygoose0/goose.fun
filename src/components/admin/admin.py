from bs4 import BeautifulSoup
import requests


def function(doc_url):

    response = requests.get(doc_url)
    response.raise_for_status()
    html_content = response.text
    
    soup = BeautifulSoup(html_content, 'html.parser')
    text_content = soup.get_text(separator="\n")
    lines = text_content.splitlines()
    lines = [item for item in lines if item.strip()]

    coordinates_map = {}
    max_x = 0
    max_y = 0
    started=False
    index = 0 
    
    for line in lines:
        if not started and line[0].isdigit():
            started = True

        if started:
            item = line.strip()
            
            if index == 0:
                current_x=int(item)
                max_x = max(max_x, current_x)
            elif index == 1:
                current_symbol=item
            elif index == 2:
                current_y=int(item)
                max_y = max(max_y, current_y)
                coordinates_map[(current_x, current_y)] = current_symbol

            index = (index + 1) % 3

    print(coordinates_map)

    print(max_y)
    print(max_x)


    for y in range(max_y, -1, -1):
        row = " "
        for x in range(0, max_x):
            row += coordinates_map.get((x, y), " ")
        print(row)



sample = "https://docs.google.com/document/d/e/2PACX-1vRMx5YQlZNa3ra8dYYxmv-QIQ3YJe8tbI3kqcuC7lQiZm-CSEznKfN_HYNSpoXcZIV3Y_O3YoUB1ecq/pub"
doc_url = "https://docs.google.com/document/d/e/2PACX-1vQGUck9HIFCyezsrBSnmENk5ieJuYwpt7YHYEzeNJkIb9OSDdx-ov2nRNReKQyey-cwJOoEKUhLmN9z/pub"


function(doc_url)

