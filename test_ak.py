import akshare as ak

funcs = [f for f in dir(ak) if callable(getattr(ak, f))]
res = []
for f in funcs:
    func = getattr(ak, f)
    if func.__doc__ and '快讯' in func.__doc__:
        res.append(f)
print("Found:", res)
