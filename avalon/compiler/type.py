# -*- coding: utf-8 -*-
#==============================================================================
# Copyright:    Hybrid Labs
# Licence:      Private
#==============================================================================

"""
Basic types
"""


class generator(object):
    def __init__(self, ctx):
        self.ctx = ctx

    def next(self):
        return self.send(None)

    def send(self, value):
        self.ctx['send'] = value
        self.ctx['func'].call(self.ctx['ctx'], self.ctx)
        if self.ctx['end']:
            raise StopIteration()
        return self.ctx['result']

    def throw(self):
        pass

    def close(self):
        pass


class Exception(object):
    pass


class StopIteration(Exception):
    pass
