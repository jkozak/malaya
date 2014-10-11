#!/usr/bin/env python

from decimal import Decimal
import datetime
import json


def import_init_db(filename):
    tables = eval(open(filename).read())
    ans    = []
    for table in eval(open(filename).read()):
        cols = tables[table][0]
        rows = tables[table][1]
        for row in rows:
            ans.append([table,dict(zip(cols,row))])
    def default(obj):
        if isinstance(obj,Decimal):
            return int(obj)
        elif isinstance(obj,datetime.datetime):
            return obj.ctime()
        else:
            raise RuntimeException("blah object");
    print json.dumps(ans,encoding="ISO-8859-1",default=default)

if __name__=='__main__':
    import sys
    import_init_db(sys.argv[1])
