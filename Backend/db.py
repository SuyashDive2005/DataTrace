import mysql.connector

def get_connection():
    return mysql.connector.connect(
        host="localhost",
        user="Suyash",
        password="PICTSuyashIT2005UpDx",
        database="trust_system"
    )