#!/usr/bin/env python

from decimal import Decimal
import datetime
import json
import sys

# +++ export in malaya-serialised format "date:..." and so on +++


def import_init_db(filename,ms):
    tables = eval(open(filename).read())
    ans    = []
    if ms:
        def cell_format(cell):
            if isinstance(cell,str) or isinstance(cell,unicode):
                return ':'+cell
            else:
                return cell
        for table in eval(open(filename).read()):
            cols = tables[table][0]
            rows = [[cell_format(cell) for cell in row] for row in tables[table][1]]
            for row in rows:
                ans.append([':'+table,dict(zip(cols,row))])
    else:
        for table in eval(open(filename).read()):
            cols = tables[table][0]
            rows = tables[table][1]
            for row in rows:
                ans.append([table,dict(zip(cols,row))])
        print >>sys.stderr,"*** import table: %s  #rows: %d"%(table,len(rows))
    def default(obj):
        if isinstance(obj,Decimal):
            return int(obj)
        elif isinstance(obj,datetime.datetime):
            return "date:"+obj.ctime() if ms else obj.ctime()
        else:
            raise RuntimeException("blah object");
    print json.dumps(ans,encoding="ISO-8859-1",default=default)

if __name__=='__main__':
    import sys
    if (sys.argv[1]=='--malaya-serialised'):
        filename = sys.argv[2]
        ms       = True
    else:
        filename = sys.argv[1]
        ms       = False
    import_init_db(filename,ms)
